import geistMono400 from '../fonts/geist-mono-400.woff2?inline'
import geistMono700 from '../fonts/geist-mono-700.woff2?inline'
import lora400 from '../fonts/lora-400.woff2?inline'
import lora400Italic from '../fonts/lora-400-italic.woff2?inline'
import lora500 from '../fonts/lora-500.woff2?inline'
import newsreader400 from '../fonts/newsreader-400.woff2?inline'
import newsreader400Italic from '../fonts/newsreader-400-italic.woff2?inline'
import newsreader500 from '../fonts/newsreader-500.woff2?inline'
import poppins400 from '../fonts/poppins-400.woff2?inline'
import poppins500 from '../fonts/poppins-500.woff2?inline'
import poppins600 from '../fonts/poppins-600.woff2?inline'
import poppins700 from '../fonts/poppins-700.woff2?inline'
import katexAmsRegular from 'katex/dist/fonts/KaTeX_AMS-Regular.woff2?inline'
import katexCaligraphicBold from 'katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2?inline'
import katexCaligraphicRegular from 'katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?inline'
import katexFrakturBold from 'katex/dist/fonts/KaTeX_Fraktur-Bold.woff2?inline'
import katexFrakturRegular from 'katex/dist/fonts/KaTeX_Fraktur-Regular.woff2?inline'
import katexMainBold from 'katex/dist/fonts/KaTeX_Main-Bold.woff2?inline'
import katexMainBoldItalic from 'katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?inline'
import katexMainItalic from 'katex/dist/fonts/KaTeX_Main-Italic.woff2?inline'
import katexMainRegular from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?inline'
import katexMathBoldItalic from 'katex/dist/fonts/KaTeX_Math-BoldItalic.woff2?inline'
import katexMathItalic from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?inline'
import katexSansSerifBold from 'katex/dist/fonts/KaTeX_SansSerif-Bold.woff2?inline'
import katexSansSerifItalic from 'katex/dist/fonts/KaTeX_SansSerif-Italic.woff2?inline'
import katexSansSerifRegular from 'katex/dist/fonts/KaTeX_SansSerif-Regular.woff2?inline'
import katexScriptRegular from 'katex/dist/fonts/KaTeX_Script-Regular.woff2?inline'
import katexSize1Regular from 'katex/dist/fonts/KaTeX_Size1-Regular.woff2?inline'
import katexSize2Regular from 'katex/dist/fonts/KaTeX_Size2-Regular.woff2?inline'
import katexSize3Regular from 'katex/dist/fonts/KaTeX_Size3-Regular.woff2?inline'
import katexSize4Regular from 'katex/dist/fonts/KaTeX_Size4-Regular.woff2?inline'
import katexTypewriterRegular from 'katex/dist/fonts/KaTeX_Typewriter-Regular.woff2?inline'

export const exportFontCss = `
@font-face {
  font-family: 'Geist Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${geistMono400}) format('woff2');
}

@font-face {
  font-family: 'Geist Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(${geistMono700}) format('woff2');
}

@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${poppins400}) format('woff2');
}

@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(${poppins500}) format('woff2');
}

@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(${poppins600}) format('woff2');
}

@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(${poppins700}) format('woff2');
}

@font-face {
  font-family: 'Newsreader';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${newsreader400}) format('woff2');
}

@font-face {
  font-family: 'Newsreader';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(${newsreader400Italic}) format('woff2');
}

@font-face {
  font-family: 'Newsreader';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(${newsreader500}) format('woff2');
}

@font-face {
  font-family: 'Lora';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${lora400}) format('woff2');
}

@font-face {
  font-family: 'Lora';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(${lora400Italic}) format('woff2');
}

@font-face {
  font-family: 'Lora';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(${lora500}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_AMS';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexAmsRegular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Caligraphic';
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url(${katexCaligraphicBold}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Caligraphic';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexCaligraphicRegular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Fraktur';
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url(${katexFrakturBold}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Fraktur';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexFrakturRegular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Main';
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url(${katexMainBold}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Main';
  font-style: italic;
  font-weight: 700;
  font-display: block;
  src: url(${katexMainBoldItalic}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Main';
  font-style: italic;
  font-weight: 400;
  font-display: block;
  src: url(${katexMainItalic}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Main';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexMainRegular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Math';
  font-style: italic;
  font-weight: 700;
  font-display: block;
  src: url(${katexMathBoldItalic}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Math';
  font-style: italic;
  font-weight: 400;
  font-display: block;
  src: url(${katexMathItalic}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_SansSerif';
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url(${katexSansSerifBold}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_SansSerif';
  font-style: italic;
  font-weight: 400;
  font-display: block;
  src: url(${katexSansSerifItalic}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_SansSerif';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexSansSerifRegular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Script';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexScriptRegular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Size1';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexSize1Regular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Size2';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexSize2Regular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Size3';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexSize3Regular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Size4';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexSize4Regular}) format('woff2');
}

@font-face {
  font-family: 'KaTeX_Typewriter';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(${katexTypewriterRegular}) format('woff2');
}
`
