import fs from 'fs';
import path from 'path';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'index.html');
  try {
    const html = fs.readFileSync(filePath, 'utf-8');
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return new Response('ORVÉLIA Platform index.html not found.', { status: 404 });
  }
}
