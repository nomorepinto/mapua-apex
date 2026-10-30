import {
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'usernameOrNull', async: false })
class UsernameOrNullConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null) {
      return true;
    }
    return typeof value === 'string' && value.length > 0 && value.length <= 128;
  }

  defaultMessage(): string {
    return 'The username field must be a Cognito username or null.';
  }
}

export class AssignAccountDto {
  @Validate(UsernameOrNullConstraint)
  username!: string | null;
}
