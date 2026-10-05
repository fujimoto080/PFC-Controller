'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { sendFeedback } from '@/lib/client/api';
import { toast } from '@/lib/toast';

/** 要望・不具合を GitHub Issue として起票する。 */
export function FeedbackPanel() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>フィードバック</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            sendFeedback({ title, body })
              .then(() => {
                toast.success('送信しました。ありがとうございます');
                setTitle('');
                setBody('');
              })
              .catch((error: unknown) => {
                toast.fromError('フィードバックの送信に失敗しました', error);
              })
              .finally(() => {
                setPending(false);
              });
          }}
        >
          <Input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            placeholder="タイトル"
            aria-label="タイトル"
            maxLength={100}
            required
          />
          <Textarea
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
            }}
            placeholder="要望や不具合の内容"
            aria-label="内容"
            rows={5}
            maxLength={2000}
            required
          />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={pending || !title.trim() || !body.trim()}
          >
            {pending ? <Loader2 className="animate-spin" /> : '送信'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
