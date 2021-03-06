import { getDomElementOffset } from './globalFunctions';

const getContentAreaOffset = () => {
  let offset = 20; // 20px above the post
  const navbar = document.getElementById('navbar');
  if (navbar) {
    offset += navbar.getBoundingClientRect().height; // 60
  }
  // We may not have top-post-sticky class yet because the scroll is currently
  // at the top of page.
  const topPostForm = document.getElementById('top-post-form');
  if (topPostForm) {
    offset += topPostForm.getBoundingClientRect().height; // 110
  }
  return offset;
};

export const scrollToPost = (postElement, smooth = true) => {
  // Scroll after the post is painted.
  requestAnimationFrame(() => {
    const scrollY = getDomElementOffset(postElement).top;
    const elmOffset = scrollY - getContentAreaOffset();
    if (smooth) {
      window.scrollTo({ top: elmOffset, left: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: elmOffset, left: 0 });
    }
  });
};

export default () => {
  const { hash } = window.location;
  if (hash !== '') {
    const id = hash.replace('#', '').split('?')[0];
    // Push onto callback queue so it runs after the DOM is updated,
    // this is required when navigating from a different page so that
    // the element is rendered on the page before trying to getElementById.
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        scrollToPost(element);
      }
    }, 0);
  }
};