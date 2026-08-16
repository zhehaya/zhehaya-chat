// zhehaya chat · Service Worker
// 接收 Web Push，在手机 / 桌面弹出系统通知（手机浏览器不支持网页 Notification，只能靠它）
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "zhehaya chat";
  const body = data.body || "新消息";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "gifs/1.gif",
      badge: "gifs/1.gif",
      tag: "zhehaya-msg",
      data: { url: data.url || "/" },
    })
  );
});

// 点击通知：聚焦 / 打开聊天页面
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(event.notification.data.url || "/");
          return c.focus();
        }
      }
      return self.clients.openWindow(event.notification.data.url || "/");
    })
  );
});
