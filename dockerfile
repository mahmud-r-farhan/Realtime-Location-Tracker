FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy only package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Expose port (must match the one in server.js)
EXPOSE 3007

# Start the app
CMD ["node", "app.js"]
