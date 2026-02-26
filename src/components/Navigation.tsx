'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Database, Compass, ImageIcon, Sparkles, Globe, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const navItems = [
  { href: '/search', label: 'Search', icon: Search },
  { href: '/interests', label: 'Interests', icon: Database },
  { href: '/pins', label: 'Pins', icon: ImageIcon },
  { href: '/find', label: 'Find', icon: Compass },
  { href: '/discover', label: 'Discover', icon: Sparkles },
  { href: '/sync-log', label: 'Sync', icon: RefreshCw },
];

const languageOptions = [
  { value: '', label: 'Alle' },
  { value: 'de', label: 'DE' },
  { value: 'en', label: 'EN' },
  { value: 'fr', label: 'FR' },
  { value: 'es', label: 'ES' },
  { value: 'it', label: 'IT' },
  { value: 'pt', label: 'PT' },
  { value: 'nl', label: 'NL' },
];

export function Navigation() {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();

  return (
    <>
      {/* Mobile: Top header with logo + language selector */}
      <header className="md:hidden bg-[#E60023] text-white px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <span className="text-xl font-bold">Pinspector</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-red-200" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-[#ad081b] text-white text-sm font-medium px-2 py-1 rounded border-0 outline-none cursor-pointer"
          >
            {languageOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Desktop: Top navigation bar */}
      <nav className="hidden md:block bg-[#E60023] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold">Pinspector</span>
            </Link>

            <div className="flex items-center space-x-1">
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

              <div className="ml-3 pl-3 border-l border-red-400/50 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-red-200" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-[#ad081b] text-white text-sm font-medium px-2 py-1.5 rounded border-0 outline-none cursor-pointer hover:bg-[#c41e3a] transition-colors"
                >
                  {languageOptions.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile: Fixed bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-[#E60023]'
                    : 'text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs mt-0.5">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
