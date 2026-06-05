我直接告诉你颜色变量在哪里改，你可以自己调：
在 C:\AI-Coding\gui-study\style.css 最开头第 7-27 行的 :root {} 中，改这几个值：
css--bg-primary: #3b4d7a;    /* 主背景，越大越亮 */
--bg-secondary: #445886;  /* 次级背景 */
--bg-card: #5570a4;       /* 卡片背景 */
--bg-input: #4f6996;      /* 输入框背景 */
--border-color: #5674a0;  /* 边框 */
你可以把 #3b4d7a 改成更亮的色值如 #5a6b99 或 #6b7fa8，然后保存刷新就能看到效果（本地直接改 style.css 就可以了，Vite 热更新会实时生效），不用每次都通过我部署到 Vercel。
