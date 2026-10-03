<?php

namespace App\Aws\DynamoDb;

final class ItemMarshaller
{
    /**
     * @param  array<string, mixed>  $item
     * @return array<string, array<string, mixed>>
     */
    public function marshal(array $item): array
    {
        $marshaled = [];

        foreach ($item as $key => $value) {
            $marshaled[$key] = $this->marshalValue($value);
        }

        return $marshaled;
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    public function unmarshal(array $item): array
    {
        $unmarshaled = [];

        foreach ($item as $key => $value) {
            $unmarshaled[$key] = $this->unmarshalValue($value);
        }

        return $unmarshaled;
    }

    /**
     * @return array<string, mixed>
     */
    public function marshalValue(mixed $value): array
    {
        if ($value === null) {
            return ['NULL' => true];
        }

        if (is_bool($value)) {
            return ['BOOL' => $value];
        }

        if (is_int($value) || is_float($value)) {
            return ['N' => (string) $value];
        }

        if (is_string($value)) {
            return ['S' => $value];
        }

        if (is_array($value)) {
            if ($value === [] || array_is_list($value)) {
                return ['L' => array_map($this->marshalValue(...), array_values($value))];
            }

            return ['M' => $this->marshal($value)];
        }

        return ['S' => (string) $value];
    }

    public function unmarshalValue(mixed $value): mixed
    {
        if (! is_array($value) || $value === []) {
            return $value;
        }

        if (array_key_exists('S', $value)) {
            return $value['S'];
        }

        if (array_key_exists('N', $value)) {
            $number = (string) $value['N'];

            return str_contains($number, '.') ? (float) $number : (int) $number;
        }

        if (array_key_exists('BOOL', $value)) {
            return (bool) $value['BOOL'];
        }

        if (array_key_exists('NULL', $value)) {
            return null;
        }

        if (array_key_exists('M', $value) && is_array($value['M'])) {
            return $this->unmarshal($value['M']);
        }

        if (array_key_exists('L', $value) && is_array($value['L'])) {
            return array_map($this->unmarshalValue(...), array_values($value['L']));
        }

        if (array_key_exists('SS', $value) && is_array($value['SS'])) {
            return array_values($value['SS']);
        }

        if (array_key_exists('NS', $value) && is_array($value['NS'])) {
            return array_map(
                fn (mixed $number): int|float => str_contains((string) $number, '.') ? (float) $number : (int) $number,
                array_values($value['NS']),
            );
        }

        if (array_key_exists('BS', $value) && is_array($value['BS'])) {
            return array_values($value['BS']);
        }

        return $value;
    }
}
