FROM node:22-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy backend source code
COPY backend/src ./src

# Expose port
EXPOSE 5000

# Start app
CMD ["npm", "start"]
