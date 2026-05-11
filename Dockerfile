# Use Fedora as the base image
FROM fedora:latest

# Install Python and pip
RUN dnf install -y python3 python3-pip

# Install build dependencies including Python development headers
RUN dnf install -y \
        gcc \
        glibc-devel \
        python3-devel \
        make \
    && dnf clean all

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy backend files
COPY dmdgs_backend/ .

# Copy .env file for MongoDB Atlas connection
# COPY dmdgs_backend/src/communication/database_connector/.env .

# Expose port 5002
EXPOSE 5002

# Command to run the backend
CMD ["python3", "src/communication/run_backend.py"]
