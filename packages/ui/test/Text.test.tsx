import { render, screen } from '@testing-library/react-native';
import { KText } from '../src/Text';

describe('KText', () => {
  it('renders the title variant in ink by default', async () => {
    await render(<KText variant="title">Hello</KText>);
    expect(screen.getByText('Hello')).toHaveStyle({ fontSize: 24, color: '#141414' });
  });

  it('applies a token color', async () => {
    await render(
      <KText variant="label" color="brandStrong">
        Small
      </KText>,
    );
    expect(screen.getByText('Small')).toHaveStyle({ color: '#b84424' });
  });
});
