'use client';

import { TutorialStep } from '../tutorial/tutorial-step';
import { CodeBlock } from '../tutorial/code-block';

export default function FetchDataSteps() {
  return (
    <div className="space-y-8">
      <TutorialStep
        title="Fetch data from your Supabase database"
      >
        <CodeBlock
          filename="app/page.tsx"
          code={`import { createClient } from '@/utils/supabase/server';

export default async function Page() {
  const supabase = await createClient();
  const { data: todos } = await supabase.from('todos').select();

  return <pre>{JSON.stringify(todos, null, 2)}</pre>;
}`}
        />
      </TutorialStep>
    </div>
  );
}
