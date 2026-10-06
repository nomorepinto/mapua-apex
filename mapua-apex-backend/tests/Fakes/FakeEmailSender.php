<?php

namespace Tests\Fakes;

use App\Support\Email\EmailSender;

final class FakeEmailSender implements EmailSender
{
    /**
     * @var list<array{to: string, subject: string, body: string}>
     */
    private array $sent = [];

    public function send(string $to, string $subject, string $body): void
    {
        $this->sent[] = ['to' => $to, 'subject' => $subject, 'body' => $body];
    }

    /**
     * @return list<array{to: string, subject: string, body: string}>
     */
    public function sent(): array
    {
        return $this->sent;
    }

    public function count(): int
    {
        return count($this->sent);
    }

    /**
     * @return list<array{to: string, subject: string, body: string}>
     */
    public function to(string $address): array
    {
        return array_values(array_filter($this->sent, static fn (array $mail): bool => $mail['to'] === $address));
    }
}
