# -----------------------
# 1) BUILD STAGE
# -----------------------
    FROM node:16-alpine AS build

    # Create app directory
    WORKDIR /app
    
    # Copy package files and install dependencies
    COPY package*.json ./
    RUN npm install
    
    # Copy the rest of your source code
    COPY . .
    
    # Build the production files
    RUN npm run build
    
    # -----------------------
    # 2) RUN STAGE (NGINX)
    # -----------------------
    FROM nginx:alpine
    
    # Copy the built files from the 'build' stage
    # The Vite build output should be in /app/dist
    COPY --from=build /app/dist /usr/share/nginx/html
    
    # Expose port 80 for the container
    EXPOSE 80
    
    # Start nginx
    CMD ["nginx", "-g", "daemon off;"]
    