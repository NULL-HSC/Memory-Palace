# 视觉方向(2026-08-28 参考图定稿)

> 来源:产品负责人提供的参考图(~/Downloads/参考图)+ 日系中文字体包。视觉改版以此为准。

## 色彩系统(参考图 20260828-200614.png)

| 色 | 值 | 占比 |
|---|---|---|
| Cream Paper | #FFF9EE | 45% |
| Mist Blue | #D9EEF4 | 20% |
| Clear Sky | #8ED4E8 | 15% |
| Story Blue | #2F9FC8 | 10% |
| Butter Yellow | #FFD86A | 7% |
| Ink Blue | #176A91 | 3% |
| Accent Coral | #F2674F | 点缀(但 CTA 按钮已改用 story blue 系,coral 不再承担主按钮) |

## 剪贴簿语言(参考图通篇的手法)

- **波浪/扇贝形边缘**(scalloped wave):页面顶部/底部的分节用蓝色波浪带过渡,带虚线车缝边
- **和纸胶带(washi tape)**:斜贴在小卡边角,黄色/格子纹
- **格子布纹(gingham check)**:浅蓝白格,做卡片内芯/背景填充
- **虚线车缝(dashed stitching)**:分区线的收尾方式
- **小闪光/手绘星芒**:标题两侧的点缀

## 首页形态(参考图 exec-05a0,最贴近「展览馆」隐喻)

- 顶部:波浪带 + 小标签牌("My stories" 写在布标签上)
- 主体:**大拍立得卡**,用夹子/挂绳吊着,内芯格子纹;前置故事即挂墙展示
- CTA:**butter yellow 大圆 + 号**(蓝色加号),缀手绘小线条
- **companion 站在底部地面上**(右下角,脚踩底部波浪带/地面,不悬空)
- 底部可以用波浪形色带收边

## 角色美术方向

3D 黏土风小动物(圆头、大眼、哑光材质、柔和顶光):绿兔耳机、暹罗猫紫耳机围巾、紫猫西装、黄猫眼镜背心、棕狗水手领、粉兔黑玫瑰。现有 public/avatars/ 占位图后续可整体替换为这套风格。

## 字体

- 拉丁/数字:Newsreader(现状保留,letters 气质)
- **中文:小赖字体(XiaolaiSC-Regular)** —— 可爱手写体,简体覆盖全;文件在 `public/fonts/XiaolaiSC-Regular.ttf`(21MB,后续可做 subset 优化)
- 接入方式:globals.css 加 `@font-face`,font-family 栈里 Newsreader 在前、小赖在后(拉丁走衬线,中文落手写)
