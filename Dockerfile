# Start from AWS's Python 3.9 base image
FROM public.ecr.aws/lambda/python:3.9

# Force Docker format (not OCI) and platform
FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.9 as builder

# Install system dependencies (FFmpeg + crepe dependencies)
RUN yum install -y ffmpeg git make gcc gcc-c++ && \
    yum clean all && \
    rm -rf /var/cache/yum

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    # Clean up to reduce image size
    rm -rf /root/.cache/pip

# Special handling for crepe (may need TensorFlow dependencies)
RUN pip install --no-cache-dir tensorflow-cpu==2.10.0 && \
    # Verify crepe installation
    python -c "import crepe; print('CREPE version:', crepe.__version__)"

# Copy your Lambda function code
COPY lambda_function.py .

# Set the handler (matches your filename.function)
CMD ["lambda_function.lambda_handler"]