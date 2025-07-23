# 使用 Node.js 作为构建阶段
FROM node:18 AS build-stage

# 设置工作目录
WORKDIR /app

# 复制所有项目文件
COPY . .

# 安装依赖
RUN npm install

# 运行构建
RUN npm run build:prod

# 使用 Nginx 作为生产环境服务器
FROM nginx:alpine AS production-stage

# 复制 Vue 生成的 `dist` 目录到 Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html
# 注意：config.json 作为运行时配置，单独 COPY 一份（也可挂载）
COPY public/config.json /usr/share/nginx/html/config.json
# 配置 Nginx，重写路径 `/demo`
COPY nginx-config/default.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]