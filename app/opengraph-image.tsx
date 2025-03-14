import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'QuizLab AI'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #4F46E5, #7C3AED)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <img
            src={`${process.env.NEXT_PUBLIC_SITE_URL}/images/logo.png`}
            alt="QuizLab AI Logo"
            width="80"
            height="80"
            style={{
              marginRight: '24px',
            }}
          />
          <h1
            style={{
              fontSize: '64px',
              background: 'white',
              backgroundClip: 'text',
              color: 'transparent',
              lineHeight: '1.2',
              fontWeight: 'bold',
            }}
          >
            QuizLab AI
          </h1>
        </div>
        <p
          style={{
            fontSize: '32px',
            color: 'white',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          Transform Your Study Materials into Interactive Quizzes with AI
        </p>
      </div>
    ),
    {
      ...size,
    }
  )
} 