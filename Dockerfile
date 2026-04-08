# 使用官方的Node.js基础镜像
FROM node:20-bullseye-slim

# 设置工作目录
WORKDIR /app

# 将当前目录的内容复制到容器中
COPY package*.json ./

# 安装依赖
RUN yarn install

# 复制应用代码到容器
COPY . .

# 暴露应用使用的端口
EXPOSE 3000

# 运行应用
CMD ["yarn", "start"]
