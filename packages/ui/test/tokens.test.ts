import { tokens } from '../src/tokens';

describe('tokens', () => {
  it('has exact brand colors', () => {
    expect(tokens.color.brand).toBe('#e2643f');
    expect(tokens.color.onBrand).toBe('#2a0e06');
    expect(tokens.color.ringFresh).toBe('#8a8a8a');
  });

  it('converts display letterSpacing from em to px', () => {
    expect(tokens.type.display).toEqual({
      fontFamily: 'Geist_400Regular',
      fontSize: 40,
      lineHeight: 40,
      fontWeight: '400',
      letterSpacing: -1,
    });
  });

  it('has pill radius and spacing scale', () => {
    expect(tokens.radius.pill).toBe(999);
    expect(tokens.space[12]).toBe(48);
  });
});
