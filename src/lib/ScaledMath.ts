export const ScaledMath = {
  min(value: bigint, ...values: Array<bigint>) {
    for (const v of values) {
      if (v < value) {
        value = v;
      }
    }

    return value;
  },
  max(value: bigint, ...values: Array<bigint>) {
    for (const v of values) {
      if (v > value) {
        value = v;
      }
    }

    return value;
  },

  normalize(amount: bigint, from: number, to: number) {
    if (from > to) {
      return amount / 10n ** BigInt(from - to);
    } else if (from < to) {
      return amount * 10n ** BigInt(to - from);
    }
    return amount;
  },

  mul(a: bigint, b: bigint, decimals: number) {
    return (a * b) / 10n ** BigInt(decimals);
  },
  div(a: bigint, b: bigint, decimals: number) {
    return (a * 10n ** BigInt(decimals)) / b;
  },
} as const;
