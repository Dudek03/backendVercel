'use client';

import { useState } from 'react';

export default function LocalState() {
    const [count, setCount] = useState(0);

    return (
        <div style={{
            display: 'inline-block',
            marginLeft: '2rem',
            padding: '0.5rem',
            background: '#f0f0f0',
            borderRadius: '4px',
            color: 'black'
        }}>
            Stan layoutu: <strong>{count}</strong>
            <button
                onClick={() => setCount(c => c + 1)}
                style={{ marginLeft: '10px', padding: '2px 8px', cursor: 'pointer' }}
            >
                +1
            </button>
        </div>
    );
}
