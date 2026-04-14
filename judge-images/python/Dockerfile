FROM python:3.12-slim
WORKDIR /sandbox
RUN adduser --disabled-password --gecos "" runner
USER runner
CMD ["python", "--version"]
