/**
 * Azure Blob Storage Integration
 * 
 * Handles document upload, download, and deletion for expense receipts
 * and invoice PDFs. Uses Azure Blob Storage with SAS tokens for secure access.
 * 
 * Environment variables:
 * - AZURE_STORAGE_CONNECTION_STRING: Azure Storage connection string
 * - AZURE_STORAGE_CONTAINER_NAME: Container name (e.g., "ancora-documents")
 */

import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} from "@azure/storage-blob"

// ============================================
// Configuration
// ============================================

const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING || ""
const AZURE_STORAGE_CONTAINER_NAME =
  process.env.AZURE_STORAGE_CONTAINER_NAME || "ancora-documents"

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Allowed MIME types for expense documents
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

// ============================================
// Client Initialization
// ============================================

let blobServiceClient: BlobServiceClient | null = null
let containerClient: ContainerClient | null = null

/**
 * Check if Azure Blob Storage is configured
 */
export function isStorageConfigured(): boolean {
  return AZURE_STORAGE_CONNECTION_STRING.length > 0
}

/**
 * Get or create the BlobServiceClient
 */
function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    if (!isStorageConfigured()) {
      throw new Error(
        "Azure Blob Storage not configured. Set AZURE_STORAGE_CONNECTION_STRING environment variable."
      )
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(
      AZURE_STORAGE_CONNECTION_STRING
    )
  }
  return blobServiceClient
}

/**
 * Get or create the ContainerClient, ensuring container exists
 */
async function getContainerClient(): Promise<ContainerClient> {
  if (!containerClient) {
    const serviceClient = getBlobServiceClient()
    containerClient = serviceClient.getContainerClient(
      AZURE_STORAGE_CONTAINER_NAME
    )
    // Create container if it doesn't exist
    await containerClient.createIfNotExists({
      access: undefined, // Private access - requires SAS token
    })
  }
  return containerClient
}

// ============================================
// Validation
// ============================================

export type FileValidationResult = {
  valid: boolean
  error?: string
}

/**
 * Validate file before upload
 */
export function validateFile(
  fileName: string,
  fileSize: number,
  mimeType: string
): FileValidationResult {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size ${(fileSize / 1024 / 1024).toFixed(1)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `File type ${mimeType} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    }
  }

  // Sanitize filename
  const sanitized = sanitizeFileName(fileName)
  if (!sanitized || sanitized.length === 0) {
    return {
      valid: false,
      error: "Invalid file name",
    }
  }

  return { valid: true }
}

/**
 * Sanitize filename to prevent path traversal and special characters
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars
    .replace(/\.{2,}/g, ".") // Remove double dots
    .replace(/^\./, "_") // Don't start with dot
    .substring(0, 255) // Limit length
}

// ============================================
// Blob Path Generation
// ============================================

/**
 * Generate blob path for expense documents
 * Format: {tenantId}/expenses/{expenseId}/{timestamp}_{fileName}
 */
export function generateExpenseBlobPath(
  tenantId: string,
  expenseId: string,
  fileName: string
): string {
  const sanitized = sanitizeFileName(fileName)
  const timestamp = Date.now()
  return `${tenantId}/expenses/${expenseId}/${timestamp}_${sanitized}`
}

/**
 * Generate blob path for invoice PDFs
 * Format: {tenantId}/invoices/{invoiceNumber}.pdf
 */
export function generateInvoiceBlobPath(
  tenantId: string,
  invoiceNumber: string
): string {
  return `${tenantId}/invoices/${invoiceNumber}.pdf`
}

// ============================================
// Upload / Download / Delete
// ============================================

export type UploadResult = {
  blobUrl: string
  blobPath: string
  fileSize: number
}

/**
 * Upload a file to Azure Blob Storage
 * 
 * @param blobPath - The blob path (use generateExpenseBlobPath or generateInvoiceBlobPath)
 * @param buffer - File content as Buffer
 * @param mimeType - MIME type of the file
 * @returns Upload result with blob URL
 */
export async function uploadBlob(
  blobPath: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadResult> {
  const container = await getContainerClient()
  const blockBlobClient = container.getBlockBlobClient(blobPath)

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
    },
  })

  return {
    blobUrl: blobPath, // Store path, not full URL (generate SAS for access)
    blobPath,
    fileSize: buffer.length,
  }
}

/**
 * Download a blob as a Buffer
 * 
 * @param blobPath - The blob path to download
 * @returns File content as Buffer
 */
export async function downloadBlob(blobPath: string): Promise<Buffer> {
  const container = await getContainerClient()
  const blockBlobClient = container.getBlockBlobClient(blobPath)

  const downloadResponse = await blockBlobClient.download(0)
  const readableStreamBody = downloadResponse.readableStreamBody

  if (!readableStreamBody) {
    throw new Error("Failed to download blob: no stream body")
  }

  // Collect stream into buffer
  const chunks: Buffer[] = []
  for await (const chunk of readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

/**
 * Generate a SAS URL for temporary read access to a blob
 * 
 * @param blobPath - The blob path
 * @param expiresInMinutes - How long the URL is valid (default 60 minutes)
 * @returns Temporary access URL
 */
export async function generateSasUrl(
  blobPath: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const container = await getContainerClient()
  const blockBlobClient = container.getBlockBlobClient(blobPath)

  // Generate SAS URL using user delegation or direct method
  const sasUrl = await blockBlobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse("r"), // Read only
    startsOn: new Date(),
    expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    protocol: SASProtocol.Https,
  })

  return sasUrl
}

/**
 * Delete a blob from storage
 * 
 * @param blobPath - The blob path to delete
 */
export async function deleteBlob(blobPath: string): Promise<void> {
  const container = await getContainerClient()
  const blockBlobClient = container.getBlockBlobClient(blobPath)

  await blockBlobClient.deleteIfExists()
}

/**
 * Delete all blobs for an expense (all documents)
 * 
 * @param tenantId - Tenant ID
 * @param expenseId - Expense ID
 */
export async function deleteExpenseBlobs(
  tenantId: string,
  expenseId: string
): Promise<void> {
  const container = await getContainerClient()
  const prefix = `${tenantId}/expenses/${expenseId}/`

  for await (const blob of container.listBlobsFlat({ prefix })) {
    await container.deleteBlob(blob.name)
  }
}

// ============================================
// Local Fallback (Development)
// ============================================

/**
 * For development without Azure, provide a local storage fallback
 * that stores files in the filesystem. This is automatically used
 * when AZURE_STORAGE_CONNECTION_STRING is not configured.
 */
export class LocalStorageFallback {
  private basePath: string

  constructor(basePath: string = "./.local-storage") {
    this.basePath = basePath
  }

  async upload(
    blobPath: string,
    buffer: Buffer,
    _mimeType: string
  ): Promise<UploadResult> {
    const fs = await import("fs/promises")
    const path = await import("path")

    const fullPath = path.join(this.basePath, blobPath)
    const dir = path.dirname(fullPath)

    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(fullPath, buffer)

    return {
      blobUrl: blobPath,
      blobPath,
      fileSize: buffer.length,
    }
  }

  async download(blobPath: string): Promise<Buffer> {
    const fs = await import("fs/promises")
    const path = await import("path")

    const fullPath = path.join(this.basePath, blobPath)
    return await fs.readFile(fullPath)
  }

  async delete(blobPath: string): Promise<void> {
    const fs = await import("fs/promises")
    const path = await import("path")

    const fullPath = path.join(this.basePath, blobPath)
    try {
      await fs.unlink(fullPath)
    } catch {
      // File may not exist
    }
  }
}

// Singleton local storage for development
let localStorage: LocalStorageFallback | null = null

/**
 * Get the appropriate storage handler based on configuration.
 * Returns Azure blob functions or local filesystem fallback.
 */
export function getStorageHandler() {
  if (isStorageConfigured()) {
    return {
      upload: uploadBlob,
      download: downloadBlob,
      delete: deleteBlob,
      generateSasUrl,
      isLocal: false as const,
    }
  }

  // Local fallback for development
  if (!localStorage) {
    localStorage = new LocalStorageFallback()
  }

  return {
    upload: localStorage.upload.bind(localStorage),
    download: localStorage.download.bind(localStorage),
    delete: localStorage.delete.bind(localStorage),
    generateSasUrl: async (blobPath: string) =>
      `/api/expenses/documents/download?path=${encodeURIComponent(blobPath)}`,
    isLocal: true as const,
  }
}
