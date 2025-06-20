import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        const cookieStore = await cookies();
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              get(name: string) {
                return cookieStore.get(name)?.value;
              },
            },
          }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('You must be logged in to upload a file.');
        }

        // Validate file extension from pathname
        const fileExtension = pathname.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'csv', 'epub'];
        
        if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
          throw new Error(`File type not supported. Allowed types: ${allowedExtensions.join(', ')}`);
        }

        return {
          allowedContentTypes: [
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            'application/vnd.ms-powerpoint', // .ppt
            'application/epub+zip',
          ],
          addRandomSuffix: true, // Add random suffix to prevent filename conflicts
          allowOverwrite: false, // Don't allow overwriting existing files
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB limit
          tokenPayload: JSON.stringify({
            userId: user.id,
            fileExtension: fileExtension,
            originalFilename: pathname,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('blob upload completed', blob, tokenPayload);
        try {
          if (tokenPayload) {
            const payload = JSON.parse(tokenPayload);
            console.log('File uploaded:', {
              url: blob.url,
              userId: payload.userId,
              extension: payload.fileExtension,
              filename: payload.originalFilename
            });
          } else {
            console.log('File uploaded:', {
              url: blob.url,
              note: 'No token payload available'
            });
          }
        } catch (e) {
          console.error('Error parsing tokenPayload:', e);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
} 