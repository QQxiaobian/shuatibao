import { NavLink } from 'react-router-dom';
import { BookOpen, PenTool, Search, FileText, GraduationCap } from 'lucide-react';
import BankSwitcher from '@/components/BankSwitcher';

const NAV_ITEMS = [
  { path: '/', label: '题库管理', icon: BookOpen },
  { path: '/practice', label: '刷题练习', icon: PenTool },
  { path: '/search', label: '搜题', icon: Search },
  { path: '/exam', label: '试卷中心', icon: FileText },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-base font-semibold text-foreground hidden sm:inline">
            自托管刷题
          </span>
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <BankSwitcher />
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
