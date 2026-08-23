import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { activities } from '../data/activities';
import { getObject, getActivityProgress, completeActivity } from '../services/api';
import { ArrowLeft, Target, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Activity = () => {
  const { activityId } = useParams();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [object, setObject] = useState(null);
  const { isAuthenticated } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const activity = activities.find(a => String(a.id) === String(activityId));

  useEffect(() => {
    if (activity && activity.objectId) {
      getObject(activity.objectId).then(setObject).catch(console.error);
    }
    
    if (isAuthenticated && activity) {
      getActivityProgress(activity.id).then(res => {
        if (res && res.data && res.data.completed) {
          // You could resume state or show completion, but 
          // to keep it simple, we don't block replay.
        }
      }).catch(console.error);
    }
  }, [activity, isAuthenticated]);

  if (!activity) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <h1 className="text-3xl font-bold mb-4 text-neutral-900">Activity Not Found</h1>
        <Link to="/learning" className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white">
          Back to Learning
        </Link>
      </div>
    );
  }

  const questions = activity.questions || [];
  const question = questions[currentQuestionIndex];
  const progressPercent = questions.length > 0 ? Math.round(((currentQuestionIndex) / questions.length) * 100) : 0;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleSelectOption = (optIndex) => {
    setAnswers({ ...answers, [currentQuestionIndex]: optIndex });
  };

  const handleNext = async () => {
    if (answers[currentQuestionIndex] === undefined) {
      alert("Please select an answer before continuing.");
      return;
    }
    
    if (isLastQuestion) {
      if (isAuthenticated) {
        setIsUpdating(true);
        try {
          await completeActivity(activity.id);
        } catch (err) {
          console.error("Failed to complete activity", err);
        } finally {
          setIsUpdating(false);
          setIsCompleted(true);
        }
      } else {
        setIsCompleted(true);
      }
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsCompleted(false);
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.answer) score++;
    });
    return score;
  };

  // Result View
  if (isCompleted) {
    const score = calculateScore();
    const percent = Math.round((score / questions.length) * 100);
    
    let message = "Keep exploring and try again.";
    if (percent >= 90) message = "Excellent work!";
    else if (percent >= 70) message = "Great job!";
    else if (percent >= 50) message = "Good start! Explore the topic again.";

    return (
      <div className="w-full max-w-3xl mx-auto py-12">
        <div className="text-center mb-12">
          <Target className="w-16 h-16 text-neutral-900 mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">Activity Complete</h1>
          <p className="text-2xl text-neutral-600 mb-8">{message}</p>
          <div className="inline-flex items-center justify-center bg-neutral-100 rounded-2xl p-8 mb-8 border border-neutral-200">
            <div className="text-center">
               <div className="text-5xl font-bold text-neutral-900 mb-2">{score} / {questions.length}</div>
               <div className="text-lg font-medium text-neutral-500 uppercase tracking-wider">{percent}% Correct</div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={handleRestart} className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50">
              <RefreshCw className="w-4 h-4 mr-2" /> TRY AGAIN
            </button>
            <Link to="/learning" className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50">
              LEARN MORE
            </Link>
            {activity.objectId && (
              <Link to={`/objects/${activity.objectId}`} className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800">
                VIEW OBJECT
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-neutral-900 text-center border-t border-neutral-200 pt-12">Review Your Answers</h2>
          {questions.map((q, idx) => {
            const isCorrect = answers[idx] === q.answer;
            return (
              <div key={q.id} className={`p-6 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <h3 className="font-bold text-lg mb-4">{idx + 1}. {q.question}</h3>
                <div className="mb-4">
                  <p className="text-sm text-neutral-600 mb-1">Your answer:</p>
                  <p className={`font-semibold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                    {answers[idx] !== undefined ? q.options[answers[idx]] : "No answer provided"}
                  </p>
                </div>
                {!isCorrect && (
                  <div className="mb-4">
                    <p className="text-sm text-neutral-600 mb-1">Correct answer:</p>
                    <p className="font-semibold text-green-700">{q.options[q.answer]}</p>
                  </div>
                )}
                {q.explanation && (
                  <div className="mt-4 pt-4 border-t border-neutral-200/50">
                    <p className="text-sm text-neutral-700 italic">"{q.explanation}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Quiz View
  return (
    <div className="w-full max-w-2xl mx-auto">
      <nav className="flex text-sm text-neutral-500 mb-8" aria-label="Breadcrumb">
        <Link to="/learning" className="hover:text-neutral-900 transition-colors flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1" /> Exit Activity
        </Link>
      </nav>

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">{activity.title}</h1>
        <p className="text-neutral-600">{activity.description}</p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-10 shadow-sm">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2 text-sm font-medium text-neutral-500">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin="0" aria-valuemax="100">
            <div className="bg-neutral-900 h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        {/* Question */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-900 leading-snug">{question.question}</h2>
        </div>

        {/* Options */}
        <fieldset className="space-y-3 mb-10">
          <legend className="sr-only">Answer options</legend>
          {question.options.map((opt, idx) => {
            const isSelected = answers[currentQuestionIndex] === idx;
            return (
              <label 
                key={idx} 
                className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  isSelected ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                <input 
                  type="radio" 
                  name={`q-${question.id}`} 
                  value={idx} 
                  checked={isSelected}
                  onChange={() => handleSelectOption(idx)}
                  className="w-5 h-5 text-neutral-900 border-neutral-300 focus:ring-neutral-900 focus:ring-2"
                />
                <span className="ml-3 text-lg text-neutral-800">{opt}</span>
              </label>
            );
          })}
        </fieldset>

        {/* Controls */}
        <div className="flex justify-between items-center pt-6 border-t border-neutral-100">
          <button 
            onClick={handlePrevious} 
            disabled={currentQuestionIndex === 0}
            className="px-6 py-3 font-semibold text-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed hover:text-neutral-900 transition-colors"
          >
            PREVIOUS
          </button>
          
          <button 
            onClick={handleNext}
            disabled={isUpdating}
            className={`px-8 py-3 rounded-md font-bold text-white transition-colors ${
              isUpdating ? 'bg-neutral-400 cursor-not-allowed' : 'bg-neutral-900 hover:bg-neutral-800'
            }`}
          >
            {isUpdating ? 'SAVING...' : (isLastQuestion ? 'SUBMIT' : 'NEXT')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Activity;
