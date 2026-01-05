import React from 'react';
import { WebsiteSections } from './WebsiteSections';

/**
 * Thin wrapper component that renders the marketing/landing sections.
 * Useful as a distinct route entry point if needed by a router.
 */
export function Scene() {
  return (
    <>
      <WebsiteSections />
    </>
  );
} 