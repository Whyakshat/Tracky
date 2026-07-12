import React from 'react';

export default function TrackyLogo({ 
  className = "", 
  textClassName = "text-2xl", 
  lineThickness = "h-[1.5px]", 
  color = "text-white" 
}) {
  return (
    <div className={`relative inline-block select-none font-sans font-extrabold ${color} ${className}`}>
      <div className="relative px-3.5 py-1.5 leading-none">
        {/* Top offset line */}
        <div className={`absolute top-0 right-1.5 w-[72%] ${lineThickness} bg-current opacity-80`} />
        
        {/* Typography */}
        <span className={`${textClassName} tracking-tight`}>Tracky</span>
        
        {/* Bottom offset line */}
        <div className={`absolute bottom-0 left-1.5 w-[66%] ${lineThickness} bg-current opacity-80`} />
      </div>
    </div>
  );
}
