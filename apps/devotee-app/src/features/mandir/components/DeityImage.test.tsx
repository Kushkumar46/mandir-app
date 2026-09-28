import { fireEvent, render, screen } from '@testing-library/react-native';

import { homePayload } from '@/test/mandir-fixtures';

import { DeityImage } from './DeityImage';

const image = homePayload().deities[0]!.image!;

describe('DeityImage', () => {
  it('shows the chosen variant with the card as placeholder', async () => {
    await render(<DeityImage image={image} variant="full" accessibilityLabel="darshan" />);
    const el = screen.getByLabelText('darshan');
    expect(el.props.source).toEqual([expect.objectContaining({ uri: image.urls.full })]);
    expect(JSON.stringify(el.props.placeholder)).toContain(image.urls.card);
  });

  it('uses the bundled fallback when there is no image', async () => {
    await render(<DeityImage image={null} variant="full" accessibilityLabel="darshan" />);
    expect(JSON.stringify(screen.getByLabelText('darshan').props.source)).toContain('deity-fallback.webp');
  });

  it('switches to the fallback when the image fails to load', async () => {
    await render(<DeityImage image={image} variant="full" accessibilityLabel="darshan" />);
    await fireEvent(screen.getByLabelText('darshan'), 'error', { nativeEvent: { error: 'boom' } });
    const source = screen.getByLabelText('darshan').props.source;
    expect(JSON.stringify(source)).not.toContain(image.urls.full);
    expect(JSON.stringify(source)).toContain('deity-fallback.webp');
  });
});
