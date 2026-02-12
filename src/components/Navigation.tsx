'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Database, Compass, ImageIcon } from 'lucide-react';

const navItems = [
  { href: '/search', label: 'Search', icon: Search },
  { href: '/interests', label: 'Interests', icon: Database },
  { href: '/pins', label: 'Pins', icon: ImageIcon },
  { href: '/find', label: 'Find', icon: Compass },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-[#E60023] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold">Pinspector</span>
          </Link>

          <div className="flex space-x-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#ad081b] text-white'
                      : 'text-red-100 hover:bg-[#c41e3a] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
