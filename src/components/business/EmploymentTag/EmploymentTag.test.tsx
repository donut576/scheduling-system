import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmploymentTag from './index';

describe('EmploymentTag', () => {
  it('一般員工顯示「正」', () => {
    render(<EmploymentTag position="STAFF" />);
    expect(screen.getByText('正')).toBeInTheDocument();
  });

  it('約聘員工顯示「約」', () => {
    render(<EmploymentTag position="CONTRACT_STAFF" />);
    expect(screen.getByText('約')).toBeInTheDocument();
  });

  it('其他職位不顯示標籤', () => {
    const { container } = render(<EmploymentTag position="LEADER" />);
    expect(container).toBeEmptyDOMElement();
  });
});
