# Docker Setup Guide

This project uses Docker Compose to simplify local development by containerizing PostgreSQL and Redis.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac)
- Or [Docker Engine + Docker Compose](https://docs.docker.com/engine/install/) (Linux)

## Quick Start

### 1. Start the Services

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Check if services are running
docker compose ps
```

### 2. Verify Database Connection

```bash
# Check PostgreSQL logs
docker compose logs postgres

# Connect to PostgreSQL (interactive)
docker compose exec postgres psql -U ancora -d ancora
```

### 3. Initialize Database

```bash
# Push Prisma schema to database
npm run db:push

# Generate Prisma Client
npm run db:generate

# Seed with sample data
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

## Services Included

| Service | Port | Description |
|---------|------|-------------|
| **PostgreSQL 16** | 5432 | Main database |
| **Redis 7** | 6379 | Job queue (BullMQ) for Phase 2 |
| **pgAdmin** | 5050 | Database GUI (optional) |

## Common Commands

### Service Management

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart a specific service
docker compose restart postgres

# View logs
docker compose logs -f postgres
docker compose logs -f redis

# Check service status
docker compose ps
```

### Database Operations

```bash
# Open PostgreSQL shell
docker compose exec postgres psql -U ancora -d ancora

# Dump database to file
docker compose exec -T postgres pg_dump -U ancora ancora > backup.sql

# Restore database from file
docker compose exec -T postgres psql -U ancora ancora < backup.sql

# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d
npm run db:push
npm run db:seed
```

### Using pgAdmin (Optional)

```bash
# Start with pgAdmin included
docker compose --profile tools up -d

# Access pgAdmin at http://localhost:5050
# Login: admin@ancora.local / admin

# Connect to PostgreSQL from pgAdmin:
# Host: postgres (use service name, not localhost)
# Port: 5432
# Username: ancora
# Password: ancora_dev_password
# Database: ancora
```

## Environment Variables

All database credentials are stored in `.env`:

```env
# Database credentials
POSTGRES_USER=ancora
POSTGRES_PASSWORD=ancora_dev_password
POSTGRES_DB=ancora
POSTGRES_PORT=5432

# Connection string (used by Prisma)
DATABASE_URL="postgresql://ancora:ancora_dev_password@localhost:5432/ancora?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_PORT=6379
```

**IMPORTANT:** Change `POSTGRES_PASSWORD` in production!

## Data Persistence

Docker volumes are used to persist data:

```bash
# List volumes
docker volume ls | grep ancora

# Remove volumes (WARNING: deletes all data)
docker compose down -v

# Backup volume data
docker run --rm -v ancora-1_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

## Troubleshooting

### Port Already in Use

```powershell
# Windows: Find process using port 5432
netstat -ano | findstr :5432

# Kill the process
taskkill /PID <process_id> /F

# Or change the port in .env
POSTGRES_PORT=5433
```

### Cannot Connect to Database

```bash
# Check if container is running
docker compose ps

# Check container health
docker compose exec postgres pg_isready -U ancora

# View container logs
docker compose logs postgres

# Restart the service
docker compose restart postgres
```

### Permission Denied on Windows

If you get permission errors:

1. Run Docker Desktop as Administrator
2. Or add your user to `docker-users` group:
   ```powershell
   net localgroup docker-users "YOUR_USERNAME" /add
   ```

### Database Already Exists Error

```bash
# Drop and recreate the database
docker compose exec postgres psql -U ancora -c "DROP DATABASE IF EXISTS ancora;"
docker compose exec postgres psql -U ancora -c "CREATE DATABASE ancora;"
npm run db:push
```

### Reset Everything

```bash
# Stop and remove all containers, volumes, and networks
docker compose down -v

# Remove images (optional)
docker compose down --rmi all -v

# Start fresh
docker compose up -d
npm run db:push
npm run db:seed
```

## Production Considerations

When deploying to production:

1. **Use Managed Database Service**: Azure Database for PostgreSQL, AWS RDS, etc.
2. **Change Default Passwords**: Update in `.env` and redeploy
3. **Enable SSL**: Add `?sslmode=require` to `DATABASE_URL`
4. **Regular Backups**: Set up automated backups
5. **Monitor Performance**: Use Azure Monitor, Datadog, etc.

This Docker setup is for **local development only**.

## Health Checks

Both PostgreSQL and Redis include health checks:

```bash
# Check PostgreSQL health
docker compose exec postgres pg_isready -U ancora

# Check Redis health
docker compose exec redis redis-cli ping
```

## Useful PostgreSQL Commands

Inside the PostgreSQL shell (`docker compose exec postgres psql -U ancora -d ancora`):

```sql
-- List all databases
\l

-- List all tables
\dt

-- Describe a table
\d users

-- Show current database
SELECT current_database();

-- Show all users
\du

-- Quit
\q
```

## Integration with Prisma

Prisma automatically uses the `DATABASE_URL` from `.env`:

```bash
# Push schema changes
npm run db:push

# Create a migration
npm run db:migrate

# Open Prisma Studio
npm run db:studio

# Reset database and apply migrations
npx prisma migrate reset
```

---

For more information, see:
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
