import styled, { css } from 'styled-components';

const srOnlyStyles = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

export const ProductContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const ProductImage = styled.div`
  width: 100%;
  min-height: 400px;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
`;

export const ProductInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export const ProductTitle = styled.h1`
  font-size: 2rem;
  color: #333;
  margin: 0;
`;

export const ProductPrice = styled.div`
  font-size: 1.5rem;
  color: #2c5282;
  font-weight: bold;
`;

export const ProductDescription = styled.p`
  font-size: 1rem;
  color: #666;
  line-height: 1.6;
`;

export const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  width: 100%;
  font-size: 1.2rem;
  color: #666;
  background-color: #f7fafc;
  padding: 1rem 2rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  gap: 1rem;
  text-align: center;

  .loading-spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
    font-size: 1.5rem;
  }

  span[data-testid="loading-text"] {
    ${srOnlyStyles}
  }

  .sr-only {
    ${srOnlyStyles}
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

export const ErrorMessage = styled.div`
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
  border-radius: 8px;
  margin: 2rem auto;
  max-width: 600px;
  transition: all 0.3s ease;

  &.network-error {
    color: #805ad5;
    background-color: #faf5ff;
    border: 1px solid #d6bcfa;
  }

  &.general-error {
    color: #e53e3e;
    background-color: #fff5f5;
    border: 1px solid #feb2b2;
  }

  .error-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .error-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  button {
    background-color: #4299e1;
    color: white;
    border: none;
    padding: 0.5rem 1.5rem;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: #3182ce;
    }

    &:focus {
      outline: 2px solid #4299e1;
      outline-offset: 2px;
      box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
    }

    &:focus:not(:focus-visible) {
      outline: none;
    }

    &:focus-visible {
      outline: 2px solid #4299e1;
      outline-offset: 2px;
    }
  }

  p {
    margin: 0.5rem 0;
    line-height: 1.5;
  }
`;
