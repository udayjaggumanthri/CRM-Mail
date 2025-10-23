#!/bin/bash

# Docker Setup Script for Conference CRM
# This script helps set up the CRM system using Docker

set -e

echo "🐳 Conference CRM Docker Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if .env file exists
check_env() {
    print_status "Checking environment configuration..."
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from example..."
        cp env.example .env
        print_warning "Please edit .env file with your configuration before running the application"
    else
        print_success ".env file found"
    fi
}

# Build and start containers
start_containers() {
    local mode=${1:-dev}
    
    print_status "Starting containers in $mode mode..."
    
    if [ "$mode" = "prod" ]; then
        docker-compose -f docker-compose.prod.yml up --build -d
    else
        docker-compose -f docker-compose.dev.yml up --build -d
    fi
    
    print_success "Containers started successfully"
}

# Show container status
show_status() {
    print_status "Container status:"
    docker-compose ps
}

# Show logs
show_logs() {
    local service=${1:-}
    if [ -n "$service" ]; then
        docker-compose logs -f "$service"
    else
        docker-compose logs -f
    fi
}

# Stop containers
stop_containers() {
    print_status "Stopping containers..."
    docker-compose down
    print_success "Containers stopped"
}

# Clean up
cleanup() {
    print_status "Cleaning up Docker resources..."
    docker-compose down -v --remove-orphans
    docker system prune -f
    print_success "Cleanup completed"
}

# Show help
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  setup [dev|prod]    Set up and start containers (default: dev)"
    echo "  start [dev|prod]    Start containers"
    echo "  stop                Stop containers"
    echo "  restart [dev|prod]  Restart containers"
    echo "  status              Show container status"
    echo "  logs [service]      Show logs (optionally for specific service)"
    echo "  cleanup             Clean up Docker resources"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup dev        # Set up development environment"
    echo "  $0 setup prod       # Set up production environment"
    echo "  $0 logs backend     # Show backend logs"
    echo "  $0 status           # Show container status"
}

# Main script logic
main() {
    case "${1:-help}" in
        setup)
            check_docker
            check_env
            start_containers "${2:-dev}"
            show_status
            echo ""
            print_success "Setup completed!"
            echo ""
            echo "🌐 Access the application:"
            echo "   Frontend: http://localhost:3000"
            echo "   Backend API: http://localhost:5000"
            echo ""
            echo "👤 Demo accounts:"
            echo "   CEO: admin@crm.com / admin123"
            echo "   Manager: manager@crm.com / manager123"
            echo "   Agent: agent@crm.com / agent123"
            ;;
        start)
            start_containers "${2:-dev}"
            show_status
            ;;
        stop)
            stop_containers
            ;;
        restart)
            stop_containers
            start_containers "${2:-dev}"
            show_status
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
