import { useRef, forwardRef, useImperativeHandle } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

interface HCaptchaWrapperProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: string) => void;
}

export interface HCaptchaHandle {
  resetCaptcha: () => void;
}

export const HCAPTCHA_SITE_KEY = 'c20a228e-6648-42e6-aa0a-b0acd3f4930c';

export const HCaptchaWrapper = forwardRef<HCaptchaHandle, HCaptchaWrapperProps>(
  ({ onVerify, onExpire, onError }, ref) => {
    const captchaRef = useRef<HCaptcha>(null);

    useImperativeHandle(ref, () => ({
      resetCaptcha: () => {
        captchaRef.current?.resetCaptcha();
      }
    }));

    return (
      <div className="flex justify-center my-4 p-4 border border-border/60 bg-muted/30 rounded-lg shadow-sm">
        <HCaptcha
          ref={captchaRef}
          sitekey={HCAPTCHA_SITE_KEY}
          onVerify={onVerify}
          onExpire={() => {
            onExpire?.();
          }}
          onError={(err) => {
            onError?.(err);
          }}
          theme="light"
        />
      </div>
    );
  }
);

HCaptchaWrapper.displayName = 'HCaptchaWrapper';
