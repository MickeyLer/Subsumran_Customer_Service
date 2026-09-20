"use client";

import React, { useState } from 'react';
import html2canvas from 'html2canvas';

const Pic = () => {
  const [image2, setImage] = useState(null);

  const handleSaveImage = () => {
    const element = document.getElementById('my-element');
    html2canvas(element).then((canvas) => {
      const imageData = canvas.toDataURL('image/jpeg');
      setImage(imageData);
    });
  };

  console.log(image2);
  return (
    <div>
      <div id="my-element">
        <h1>This is my HTML content</h1>
        <p>fdfdsfdsfdsfdsfdsfdsfdsfd</p>
        <p>fdfdsfdsfdsfdsfdsfdsfdsfd</p>
        <p>fdfdsfdsfdsfdsfdsfdsfdsfd</p>
        <p>fdfdsfdsfdsfdsfdsfdsfdsfd</p>
        <p>fdfdsfdsfdsfdsfdsfdsfdsfd</p>
      </div>
      <button onClick={handleSaveImage}>บันทึกรูป</button>
      {image2 && <img src={image2} alt="my-image" />}
    </div>
  );
};

export default Pic;