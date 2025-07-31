import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getCookieOptions } from '@/utils/supabase/cookies-helper';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const cookieOptions = await getCookieOptions();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieOptions,
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be logged in to upload images.');
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // Validate file extension
        const fileExtension = pathname.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        
        if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
          throw new Error(`Image type not supported. Allowed types: ${allowedExtensions.join(', ')}`);
        }

        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
          ],
          addRandomSuffix: true, // Add random suffix to prevent filename conflicts
          allowOverwrite: false, // Don't allow overwriting existing files
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB limit for images
          tokenPayload: JSON.stringify({
            userId: user.id,
            fileExtension: fileExtension,
            originalFilename: pathname,
            uploadType: 'flashcard-image',
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Image upload completed', blob, tokenPayload);
        try {
          if (tokenPayload) {
            const payload = JSON.parse(tokenPayload);
            console.log('Image uploaded:', {
              url: blob.url,
              userId: payload.userId,
              extension: payload.fileExtension,
              filename: payload.originalFilename,
              type: payload.uploadType,
            });
          }
        } catch (e) {
          console.error('Error parsing tokenPayload:', e);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
} 