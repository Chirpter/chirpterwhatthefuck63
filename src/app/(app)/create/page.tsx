
// "use client" directive is removed to make this a Server Component.

import React from 'react';
import CreateView from '@/features/create/components/CreateView';

export default function CreatePage() {
    // This Server Component now correctly wraps the client-side CreateView.
    return <CreateView />;
}
