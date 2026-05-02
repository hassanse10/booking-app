FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY src ./src

# Expose port
EXPOSE 5000

# Start app
CMD ["npm", "start"]
