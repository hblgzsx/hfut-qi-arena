import { useEffect, useState } from 'react';

const beijingDateTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const beijingTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function EventClock({ offset = 0, showDate = false }: { offset?: number; showDate?: boolean }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const date = new Date(now + offset);
  return <time className="today" aria-label="当前北京时间" dateTime={date.toISOString()}>
    {(showDate ? beijingDateTime : beijingTime).format(date)}
  </time>;
}
