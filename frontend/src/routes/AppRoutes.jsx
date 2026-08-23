import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import AdminRoute from '../components/auth/AdminRoute';

import Home from '../pages/Home';
import Museums from '../pages/Museums';
import MuseumDetails from '../pages/MuseumDetails';
import MuseumHome from '../pages/MuseumHome';
import Galleries from '../pages/Galleries';
import GalleryDetails from '../pages/GalleryDetails';
import ObjectDetails from '../pages/ObjectDetails';
import ExploreMore from '../pages/ExploreMore';
import Collections from '../pages/Collections';
import CollectionDetails from '../pages/CollectionDetails';
import Exhibitions from '../pages/Exhibitions';
import ExhibitionDetails from '../pages/ExhibitionDetails';
import Learning from '../pages/Learning';
import LearningDetails from '../pages/LearningDetails';
import ObjectLearning from '../pages/ObjectLearning';
import StoryDetails from '../pages/StoryDetails';
import Activity from '../pages/Activity';
import Search from '../pages/Search';
import Scan from '../pages/Scan';
import PhysicalMuseum from '../pages/PhysicalMuseum';
import MuseumMap from '../pages/MuseumMap';
import Assistant from '../pages/Assistant';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Profile from '../pages/Profile';
import Favourites from '../pages/Favourites';
import NotFound from '../pages/NotFound';

import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminMuseums from '../pages/admin/AdminMuseums';
import AdminGalleries from '../pages/admin/AdminGalleries';
import AdminCollections from '../pages/admin/AdminCollections';
import AdminExhibitions from '../pages/admin/AdminExhibitions';
import AdminObjects from '../pages/admin/AdminObjects';
import AdminLearning from '../pages/admin/AdminLearning';
import AdminStories from '../pages/admin/AdminStories';
import AdminActivities from '../pages/admin/AdminActivities';
import AdminAnalytics from '../pages/admin/AdminAnalytics';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/museums" element={<Museums />} />
      <Route path="/museums/:museumId" element={<MuseumDetails />} />
      <Route path="/museum/:museumId" element={<MuseumHome />} />
      <Route path="/museum/:museumId/galleries" element={<Galleries />} />
      <Route path="/museum/:museumId/gallery/:galleryId" element={<GalleryDetails />} />
      <Route path="/museum/:museumId/collections" element={<Collections />} />
      <Route path="/museum/:museumId/collection/:collectionId" element={<CollectionDetails />} />
      <Route path="/museum/:museumId/exhibitions" element={<Exhibitions />} />
      <Route path="/museum/:museumId/exhibition/:exhibitionId" element={<ExhibitionDetails />} />
      <Route path="/objects/:objectId" element={<ObjectDetails />} />
      <Route path="/objects/:objectId/explore" element={<ExploreMore />} />
      <Route path="/objects/:objectId/learn" element={<ObjectLearning />} />
      <Route path="/learning" element={<Learning />} />
      <Route path="/learning/:learningId" element={<LearningDetails />} />
      <Route path="/stories/:storyId" element={<StoryDetails />} />
      <Route path="/learning/activity/:activityId" element={<Activity />} />
      <Route path="/explore" element={<ExploreMore />} />
      <Route path="/search" element={<Search />} />
      <Route path="/scan" element={<Scan />} />
      <Route path="/assistant" element={<Assistant />} />
      <Route path="/physical" element={<PhysicalMuseum />} />
      <Route path="/physical/map" element={<MuseumMap />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/favourites" element={
        <ProtectedRoute>
          <Favourites />
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      } />
      <Route path="/admin/museums" element={
        <AdminRoute>
          <AdminMuseums />
        </AdminRoute>
      } />
      <Route path="/admin/galleries" element={
        <AdminRoute>
          <AdminGalleries />
        </AdminRoute>
      } />
      <Route path="/admin/collections" element={
        <AdminRoute>
          <AdminCollections />
        </AdminRoute>
      } />
      <Route path="/admin/exhibitions" element={
        <AdminRoute>
          <AdminExhibitions />
        </AdminRoute>
      } />
      <Route path="/admin/objects" element={
        <AdminRoute>
          <AdminObjects />
        </AdminRoute>
      } />
      <Route path="/admin/learning" element={
        <AdminRoute>
          <AdminLearning />
        </AdminRoute>
      } />
      <Route path="/admin/stories" element={
        <AdminRoute>
          <AdminStories />
        </AdminRoute>
      } />
      <Route path="/admin/activities" element={
        <AdminRoute>
          <AdminActivities />
        </AdminRoute>
      } />
      <Route path="/admin/analytics" element={
        <AdminRoute>
          <AdminAnalytics />
        </AdminRoute>
      } />
      
      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
