import { NavLink } from 'react-router-dom';
import { BookOpen, PenTool, Search, FileText } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: '题库', icon: BookOpen },
  { path: '/practice', label: '刷题', icon: PenTool },
  { path: '/search', label: '搜题', icon: Search },
  { path: '/exam', label: '试卷', icon: FileText },
];

export default function BottomTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
      {/* 安全区 */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
