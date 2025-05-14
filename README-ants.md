
# 修复代码格式
```bash
npx eslint --fix /root/project/demo-mysql-console/src/views/mongodb/query-index.vue
```

# 移除敏感文件内容提交
```bash
root@DESKTOP-7PAC7TJ:~/project/kubeants-console# git rev-list --objects --all | grep 425518a066b38d8489116505a378abd28f7bd6b8
425518a066b38d8489116505a378abd28f7bd6b8 node_modules/public-encrypt/test/test_rsa_privkey.pem

# 使用 git-filter-repo 移除敏感信息：
# 安装工具
pip install git-filter-repo

git filter-repo --path path/to/your/file --invert-paths-regex '.*secret.*' 
git filter-repo --path path/to/your/file --invert-paths-regex 'node_modules/public-encrypt/test/test_rsa_privkey.pem'  # 示例：移除包含 "secret" 的行，具体正则需根据实际情况调整
# 或者直接删除文件
rm -rf node_modules/public-encrypt/test/test_rsa_privkey.pem
```

# 代码提交
```bash
echo "# kubeants-console" >> README.md
git init
git add README.md
git commit -m "first commit"
git tag v1.0.0
git branch -M main
git remote add origin git@github.com:geray-zsg/kubeants-console.git
git push -u origin main v1.0.0
```