import React from "react";
import { Link } from "react-router-dom";
import { FaHome, FaCommentDots } from "react-icons/fa";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-indigo-900 flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="bg-gray-800 bg-opacity-95 rounded-xl sm:rounded-2xl shadow-xl p-5 sm:p-8 md:p-10 max-w-xs sm:max-w-md md:max-w-lg w-full text-center backdrop-blur-sm border border-gray-700 border-opacity-50">
        <div className="mb-4 sm:mb-6">
          <div className="text-7xl sm:text-8xl md:text-9xl font-bold text-indigo-400 leading-none">404</div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-100 mt-2">Page Not Found</h1>
        </div>
        
        <div className="space-y-1 sm:space-y-2 mb-6 sm:mb-8">
          <p className="text-gray-300 text-sm sm:text-base">
            Oops! The page you're looking for doesn't exist or has been moved.
          </p>
          <p className="text-gray-400 text-xs sm:text-sm">
            Perhaps you entered the wrong URL or followed a broken link.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link 
            to="/" 
            className="bg-indigo-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors shadow-md hover:shadow-lg text-sm sm:text-base"
          >
            <FaHome /> Go to Home
          </Link>
          <Link 
            to="/join" 
            className="bg-purple-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors shadow-md hover:shadow-lg text-sm sm:text-base"
          >
            <FaCommentDots /> Join a Chat
          </Link>
        </div>
        
        <div className="mt-6 sm:mt-8 text-gray-400 text-xs sm:text-sm">
          <p>
            Need help? <a href="mailto:support@flashchat.com" className="text-indigo-400 hover:underline">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;