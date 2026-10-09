<?php

namespace App\Support\Email;

interface EmailSender
{
    /**
     * Best-effort delivery: implementations must never throw.
     */
    public function send(string $to, string $subject, string $body): void;
}
