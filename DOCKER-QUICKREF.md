# Docker Quick Reference

Quick commands for working with the Ancora Docker setup.

## Start/Stop

```powershell
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Stop and remove volumes (deletes data!)
docker compose down -v

# Restart services
docker compose restart
```

## View Status

```powershell
# List running containers
docker compose ps

# View logs (all services)
docker compose logs

# Follow logs (real-time)
docker compose logs -f

# View specific service logs
docker compose logs postgres
docker compose logs redis
```

## Database Operations

```powershell
# Connect to PostgreSQL
docker compose exec postgres psql -U ancora -d ancora

# Run SQL file
docker compose exec -T postgres psql -U ancora -d ancora < script.sql

# Backup database
docker compose exec -T postgres pg_dump -U ancora ancora > backup.sql

# Restore database
docker compose exec -T postgres psql -U ancora ancora < backup.sql
```

## Troubleshooting

```powershell
# Check if services are healthy
docker compose ps

# Restart a specific service
docker compose restart postgres

# View detailed container info
docker inspect ancora-postgres

# Remove everything and start fresh
docker compose down -v
docker compose up -d
npm run db:push
npm run db:seed
```

## pgAdmin (Database GUI)

```powershell
# Start with pgAdmin
docker compose --profile tools up -d

# Access at: http://localhost:5050
# Login: admin@ancora.local / admin

# Connect to database in pgAdmin:
# Host: postgres
# Port: 5432
# User: ancora
# Password: ancora_dev_password
```

## Common Issues

### Port 5432 already in use
```powershell
# Find process using port
netstat -ano | findstr :5432

# Change port in .env
POSTGRES_PORT=5433
```

### Cannot connect to database
```powershell
# Check container is running
docker compose ps

# Test connection
docker compose exec postgres pg_isready -U ancora

# View logs
docker compose logs postgres
```

### Database reset
```powershell
# Complete reset
docker compose down -v
docker compose up -d
npm run db:push
npm run db:seed
```

See [DOCKER.md](./DOCKER.md) for detailed documentation.
