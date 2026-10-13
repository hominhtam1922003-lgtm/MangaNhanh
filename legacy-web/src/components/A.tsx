"use client";
import React from 'react';
import { buildHref } from '@/lib/hash-router';

/**
 * Hash-router aware anchor. All internal navigation in the app MUST go through
 * this (not next/link), because the app uses hash-based routing
 * (URLs look like #/manga/nettruyen/slug) to work with static export / APK.
 */
export default function A({
  href,
  children,
  className,
  onClick,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const isExternal = /^(https?:)?\/\//.test(href) || href.startsWith('#');
  const finalHref = isExternal ? href : buildHref(href);
  return (
    <a
      href={finalHref}
      className={className}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented) return;
        if (isExternal) return; // leave external or hash alone
        // let browser handle hash change – router listens to hashchange
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
