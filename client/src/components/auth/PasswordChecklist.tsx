import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';

type StrengthLevel = 'weak' | 'fair' | 'strong';

interface PasswordStrength {
  score: number;
  label: string;
  level: StrengthLevel;
  color: string;
}

export interface PasswordCriteria {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: '', level: 'weak', color: '#94A3B8' };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) {
    return { score, label: 'Weak', level: 'weak', color: '#94A3B8' };
  }
  if (score === 2 || score === 3) {
    return { score, label: 'Medium', level: 'fair', color: '#F99EFF' };
  }

  return { score, label: 'Strong', level: 'strong', color: '#00A9E9' };
}

export function getPasswordCriteria(password: string): PasswordCriteria {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

export function areAllPasswordCriteriaMet(criteria: PasswordCriteria): boolean {
  return criteria.minLength && criteria.hasUppercase && criteria.hasNumber && criteria.hasSpecial;
}

interface PasswordChecklistProps {
  password: string;
}

export const PasswordChecklist: React.FC<PasswordChecklistProps> = ({ password }) => {
  const criteria = useMemo(() => getPasswordCriteria(password), [password]);
  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  return (
    <div
      className="p-4 rounded-xl space-y-3 border"
      style={{ backgroundColor: '#161D2F', borderColor: '#24304A' }}
    >
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span style={{ color: '#94A3B8' }}>Password strength</span>
          {password.length > 0 && (
            <span className="font-medium" style={{ color: strength.color }}>
              {strength.label}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5 h-1.5">
          {[1, 2, 3, 4].map((segment) => {
            const isActive = password.length > 0 && strength.score >= segment;
            return (
              <div
                key={segment}
                className="rounded-full transition-all duration-300"
                style={{
                  backgroundColor: isActive ? strength.color : '#24304A',
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: criteria.minLength ? '#00A9E9' : '#94A3B8' }}>
            {criteria.minLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          </span>
          <span style={{ color: criteria.minLength ? '#00A9E9' : '#94A3B8' }}>
            At least 8 characters
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: criteria.hasUppercase ? '#00A9E9' : '#94A3B8' }}>
            {criteria.hasUppercase ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          </span>
          <span style={{ color: criteria.hasUppercase ? '#00A9E9' : '#94A3B8' }}>
            Contains an uppercase letter
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: criteria.hasNumber ? '#00A9E9' : '#94A3B8' }}>
            {criteria.hasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          </span>
          <span style={{ color: criteria.hasNumber ? '#00A9E9' : '#94A3B8' }}>
            Contains a number
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: criteria.hasSpecial ? '#00A9E9' : '#94A3B8' }}>
            {criteria.hasSpecial ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          </span>
          <span style={{ color: criteria.hasSpecial ? '#00A9E9' : '#94A3B8' }}>
            Contains a special character
          </span>
        </div>
      </div>
    </div>
  );
};
