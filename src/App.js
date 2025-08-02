import React, { useState, useEffect, useRef } from 'react';
import { Calendar, dayjsLocalizer } from 'react-big-calendar';
import dayjs from 'dayjs';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './App.css';

// Initialize calendar localizer
const localizer = dayjsLocalizer(dayjs);

// Main App Component
function App() {
  const [tasks, setTasks] = useState(() => {
    const savedTasks = localStorage.getItem('tasks');
    return savedTasks ? JSON.parse(savedTasks) : [];
  });
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [showModal, setShowModal] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [view, setView] = useState('month');
  const [filters, setFilters] = useState({
    showPending: true,
    showCompleted: true,
    showTodayOnly: false
  });
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : false;
  });
  const [addingMultiple, setAddingMultiple] = useState(false);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [dragTask, setDragTask] = useState(null);
  const plannerRef = useRef(null);

  // Save tasks to localStorage
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Check if time slot is available
  const isTimeSlotAvailable = (taskId, start, end) => {
    return !tasks.some(task => 
      task.id !== taskId &&
      dayjs(start).isBefore(task.end) && 
      dayjs(end).isAfter(task.start)
    );
  };

  // Add or update task
  const saveTask = (task) => {
    // Validate time
    if (dayjs(task.start).isAfter(dayjs(task.end))) {
      alert('End time must be after start time');
      return false;
    }

    // Check for overlapping tasks
    if (!isTimeSlotAvailable(task.id, task.start, task.end)) {
      alert('This time slot overlaps with another task');
      return false;
    }

    if (task.id) {
      setTasks(tasks.map(t => t.id === task.id ? task : t));
    } else {
      setTasks([...tasks, { ...task, id: Date.now(), completed: false }]);
    }
    
    if (addingMultiple) {
      // Reset form for next task
      setCurrentTask({
        title: '',
        description: '',
        start: dayjs(task.end).toDate(),
        end: dayjs(task.end).add(1, 'hour').toDate(),
        priority: 'medium',
        completed: false
      });
      return true;
    } else {
      setShowModal(false);
      return true;
    }
  };

  // Delete task
  const deleteTask = (id) => {
    setTasks(tasks.filter(task => task.id !== id));
    setShowModal(false);
  };

  // Mark task as completed
  const markTaskCompleted = (id) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: true, completedAt: new Date() } : task
    ));
  };

  // Mark task as pending
  const markTaskPending = (id) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: false, completedAt: null } : task
    ));
  };

  // Complete all tasks for the day
  const completeAllTasks = () => {
    const updatedTasks = tasks.map(task => {
      if (dayjs(task.start).isSame(selectedDate, 'day') && !task.completed) {
        return { ...task, completed: true, completedAt: new Date() };
      }
      return task;
    });
    setTasks(updatedTasks);
  };

  // Clear all tasks for the day
  const clearAllTasks = () => {
    if (window.confirm("Are you sure you want to delete all tasks for this day?")) {
      const updatedTasks = tasks.filter(task => 
        !dayjs(task.start).isSame(selectedDate, 'day')
      );
      setTasks(updatedTasks);
    }
  };

  // Handle date selection
  const handleSelectSlot = (slotInfo) => {
    setSelectedDate(dayjs(slotInfo.start));
    setCurrentTask({
      title: '',
      description: '',
      start: slotInfo.start,
      end: dayjs(slotInfo.start).add(1, 'hour').toDate(),
      priority: 'medium',
      completed: false
    });
    setShowModal(true);
    setAddingMultiple(false);
  };

  // Handle task click
  const handleSelectEvent = (task) => {
    setCurrentTask(task);
    setShowModal(true);
    setAddingMultiple(false);
  };

  // Filter tasks based on user preferences
  const filteredTasks = tasks.filter(task => {
    if (filters.showTodayOnly && !dayjs(task.start).isSame(selectedDate, 'day')) {
      return false;
    }
    if (task.completed && !filters.showCompleted) return false;
    if (!task.completed && !filters.showPending) return false;
    return true;
  });

  // Calendar events
  const events = filteredTasks.map(task => ({
    ...task,
    title: task.title,
    start: new Date(task.start),
    end: new Date(task.end),
  }));

  // Start adding multiple tasks
  const startAddingMultiple = () => {
    setSelectedDate(dayjs());
    setCurrentTask({
      title: '',
      description: '',
      start: new Date(),
      end: dayjs().add(1, 'hour').toDate(),
      priority: 'medium',
      completed: false
    });
    setShowModal(true);
    setAddingMultiple(true);
  };

  // Handle drag start
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('task', JSON.stringify(task));
    setDragTask(task);
  };

  // Handle drag over
  const handleDragOver = (e, date) => {
    e.preventDefault();
    setDragOverDate(date);
  };

  // Handle drop
  const handleDrop = (e, date) => {
    e.preventDefault();
    const taskData = e.dataTransfer.getData('task');
    if (taskData) {
      const task = JSON.parse(taskData);
      const dayStart = dayjs(date).startOf('day');
      const dayEnd = dayjs(date).endOf('day');
      
      // Calculate new start and end times
      const originalStart = dayjs(task.start);
      const originalEnd = dayjs(task.end);
      const duration = originalEnd.diff(originalStart);
      
      const newStart = dayStart
        .hour(originalStart.hour())
        .minute(originalStart.minute())
        .toDate();
      
      const newEnd = dayjs(newStart).add(duration, 'ms').toDate();
      
      // Check if time slot is available
      if (isTimeSlotAvailable(task.id, newStart, newEnd)) {
        const updatedTask = { ...task, start: newStart, end: newEnd };
        setTasks(tasks.map(t => t.id === task.id ? updatedTask : t));
      } else {
        alert('Cannot move task - time slot overlaps with another task');
      }
    }
    setDragOverDate(null);
    setDragTask(null);
  };

  // Handle event drop (within calendar)
  const handleEventDrop = ({ event, start, end }) => {
    // Check if time slot is available
    if (isTimeSlotAvailable(event.id, start, end)) {
      const updatedTask = { ...event, start, end };
      setTasks(tasks.map(t => t.id === event.id ? updatedTask : t));
    } else {
      alert('Cannot move task - time slot overlaps with another task');
    }
  };

  // Export as image
  const exportAsImage = () => {
    if (plannerRef.current) {
      html2canvas(plannerRef.current).then(canvas => {
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = 'daily-planner.png';
        link.click();
      });
    }
  };

  // Export as PDF
  const exportAsPDF = () => {
    if (plannerRef.current) {
      html2canvas(plannerRef.current).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('daily-planner.pdf');
      });
    }
  };

  // Render drag and drop indicator
  const renderDragIndicator = () => {
    if (dragOverDate) {
      return (
        <div className="drag-indicator">
          Drop here to move task to {dayjs(dragOverDate).format('MMM D, YYYY')}
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className={`planner-container ${darkMode ? 'dark' : 'light'}`} 
      ref={plannerRef}
    >
      <header className="header">
        <div className="header-left">
          <h1>Smart Daily Planner</h1>
          <div className="date-display">
            {dayjs().format('dddd, MMMM D, YYYY')}
          </div>
        </div>
        <div className="controls">
          <div className="view-controls">
            <button onClick={() => setView('month')} className={`view-btn ${view === 'month' ? 'active' : ''}`}>
              Month
            </button>
            <button onClick={() => setView('week')} className={`view-btn ${view === 'week' ? 'active' : ''}`}>
              Week
            </button>
            <button onClick={() => setView('day')} className={`view-btn ${view === 'day' ? 'active' : ''}`}>
              Day
            </button>
          </div>
          <div className="utility-controls">
            <button onClick={() => setDarkMode(!darkMode)} className="theme-toggle">
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button className="add-multiple-btn" onClick={startAddingMultiple}>
              + Multiple
            </button>
            <div className="export-dropdown">
              <button className="export-btn">Export</button>
              <div className="export-options">
                <button onClick={exportAsImage}>Export as Image</button>
                <button onClick={exportAsPDF}>Export as PDF</button>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="calendar-view">
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            date={selectedDate.toDate()}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            selectable
            draggableAccessor={() => true}
            onEventDrop={handleEventDrop}
            eventPropGetter={(event) => {
              const backgroundColor = event.completed 
                ? '#4caf50' 
                : event.priority === 'high' 
                  ? '#f44336' 
                  : event.priority === 'medium' 
                    ? '#ff9800' 
                    : '#2196f3';
              return { 
                style: { 
                  backgroundColor,
                  color: 'white',
                  borderRadius: '4px',
                  border: 'none',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                } 
              };
            }}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            onView={view => setView(view)}
            onNavigate={date => setSelectedDate(dayjs(date))}
            // Mobile touch enhancements
            longPressThreshold={50}
            popup={true}
          />
        </div>
        
        <div 
          className="task-list"
          onDragOver={(e) => handleDragOver(e, selectedDate.toDate())}
          onDrop={(e) => handleDrop(e, selectedDate.toDate())}
        >
          <div className="task-list-header">
            <h2>Tasks for {selectedDate.format('MMM D, YYYY')}</h2>
            <div className="task-stats">
              <span className="completed-count">
                {tasks.filter(t => dayjs(t.start).isSame(selectedDate, 'day') && t.completed).length} completed
              </span>
              <span className="pending-count">
                {tasks.filter(t => dayjs(t.start).isSame(selectedDate, 'day') && !t.completed).length} pending
              </span>
            </div>
          </div>
          
          {renderDragIndicator()}
          
          {tasks.filter(t => dayjs(t.start).isSame(selectedDate, 'day')).length === 0 ? (
            <div className="no-tasks">
              <div className="no-tasks-icon">📅</div>
              <p>No tasks scheduled for this day</p>
              <p>Click on the calendar to add a new task</p>
            </div>
          ) : (
            <ul>
              {tasks
                .filter(t => dayjs(t.start).isSame(selectedDate, 'day'))
                .map(task => (
                <li 
                  key={task.id} 
                  className={`task-item ${task.completed ? 'completed' : ''} priority-${task.priority}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                >
                  <div className="task-status-control">
                    {task.completed ? (
                      <button 
                        className="mark-pending-btn"
                        onClick={() => markTaskPending(task.id)}
                        title="Mark as pending"
                      >
                        ✓
                      </button>
                    ) : (
                      <button 
                        className="mark-completed-btn"
                        onClick={() => markTaskCompleted(task.id)}
                        title="Mark as completed"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                  <div className="task-content">
                    <div className="task-header">
                      <strong>{task.title}</strong>
                      <div className="task-time">
                        <time>
                          {dayjs(task.start).format('h:mm A')} - {dayjs(task.end).format('h:mm A')}
                        </time>
                        {task.completed && task.completedAt && (
                          <span className="completed-time">
                            Completed at {dayjs(task.completedAt).format('h:mm A')}
                          </span>
                        )}
                      </div>
                    </div>
                    <p>{task.description}</p>
                    <div className="task-footer">
                      <span className={`priority ${task.priority}`}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                      </span>
                      <span className={`status ${task.completed ? 'completed' : 'pending'}`}>
                        {task.completed ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {tasks.filter(t => dayjs(t.start).isSame(selectedDate, 'day')).length > 0 && (
            <div className="bulk-actions">
              <button 
                className="bulk-btn bulk-complete"
                onClick={completeAllTasks}
                disabled={tasks.filter(t => dayjs(t.start).isSame(selectedDate, 'day')).every(t => t.completed)}
              >
                Complete All
              </button>
              <button 
                className="bulk-btn bulk-clear"
                onClick={clearAllTasks}
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="filters">
        <label className="filter-item">
          <div className="checkbox-container">
            <input
              type="checkbox"
              checked={filters.showPending}
              onChange={() => setFilters({...filters, showPending: !filters.showPending})}
            />
            <div className="custom-checkbox"></div>
          </div>
          <span>Show Pending</span>
        </label>
        <label className="filter-item">
          <div className="checkbox-container">
            <input
              type="checkbox"
              checked={filters.showCompleted}
              onChange={() => setFilters({...filters, showCompleted: !filters.showCompleted})}
            />
            <div className="custom-checkbox"></div>
          </div>
          <span>Show Completed</span>
        </label>
        <label className="filter-item">
          <div className="checkbox-container">
            <input
              type="checkbox"
              checked={filters.showTodayOnly}
              onChange={() => setFilters({...filters, showTodayOnly: !filters.showTodayOnly})}
            />
            <div className="custom-checkbox"></div>
          </div>
          <span>Today Only</span>
        </label>
      </div>
      
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>{addingMultiple ? 'Add Multiple Tasks' : currentTask.id ? 'Edit Task' : 'Add New Task'}</h2>
              <button className="close-btn" onClick={() => {
                setShowModal(false);
                setAddingMultiple(false);
              }}>×</button>
            </div>
            
            {/* Scrollable form container */}
            <div className="modal-body">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  name="title"
                  value={currentTask.title}
                  onChange={(e) => setCurrentTask({...currentTask, title: e.target.value})}
                  required
                  placeholder="Task title"
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={currentTask.description}
                  onChange={(e) => setCurrentTask({...currentTask, description: e.target.value})}
                  placeholder="Task description"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <TimePicker
                    value={currentTask.start}
                    onChange={(time) => setCurrentTask({...currentTask, start: time})}
                  />
                </div>
                
                <div className="form-group">
                  <label>End Time</label>
                  <TimePicker
                    value={currentTask.end}
                    onChange={(time) => setCurrentTask({...currentTask, end: time})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Priority</label>
                <div className="priority-selector">
                  <button 
                    type="button" 
                    className={`priority-btn high ${currentTask.priority === 'high' ? 'active' : ''}`}
                    onClick={() => setCurrentTask({...currentTask, priority: 'high'})}
                  >
                    High
                  </button>
                  <button 
                    type="button" 
                    className={`priority-btn medium ${currentTask.priority === 'medium' ? 'active' : ''}`}
                    onClick={() => setCurrentTask({...currentTask, priority: 'medium'})}
                  >
                    Medium
                  </button>
                  <button 
                    type="button" 
                    className={`priority-btn low ${currentTask.priority === 'low' ? 'active' : ''}`}
                    onClick={() => setCurrentTask({...currentTask, priority: 'low'})}
                  >
                    Low
                  </button>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn-save" onClick={() => saveTask(currentTask)}>
                {currentTask.id ? 'Update' : addingMultiple ? 'Add Task' : 'Create'}
              </button>
              
              {addingMultiple && (
                <button className="btn-save-another" onClick={() => {
                  if (saveTask(currentTask)) {
                    // Success, form reset automatically
                  }
                }}>
                  Add & Next
                </button>
              )}
              
              {currentTask.id && (
                <button className="btn-delete" onClick={() => deleteTask(currentTask.id)}>
                  Delete
                </button>
              )}
              
              <button className="btn-cancel" onClick={() => {
                setShowModal(false);
                setAddingMultiple(false);
              }}>
                {addingMultiple ? 'Finish' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Time Picker Component with AM/PM
function TimePicker({ value, onChange }) {
  const time = dayjs(value);
  const hour = time.hour();
  const minute = time.minute();
  
  // Convert to 12-hour format with AM/PM
  const hour12 = hour % 12 || 12;
  const period = hour >= 12 ? 'PM' : 'AM';
  
  const handleHourChange = (e) => {
    const newHour12 = parseInt(e.target.value);
    // Convert to 24-hour format
    let newHour24 = newHour12;
    if (period === 'PM' && newHour12 !== 12) newHour24 += 12;
    if (period === 'AM' && newHour12 === 12) newHour24 = 0;
    
    const newDate = dayjs(value).hour(newHour24).minute(minute).toDate();
    onChange(newDate);
  };
  
  const handleMinuteChange = (e) => {
    const newMinute = parseInt(e.target.value);
    const newDate = dayjs(value).minute(newMinute).toDate();
    onChange(newDate);
  };
  
  const handlePeriodChange = (e) => {
    const newPeriod = e.target.value;
    let newHour24 = hour;
    
    if (period === 'AM' && newPeriod === 'PM') {
      newHour24 = (hour + 12) % 24;
    } else if (period === 'PM' && newPeriod === 'AM') {
      newHour24 = hour - 12;
      if (newHour24 < 0) newHour24 += 24;
    }
    
    const newDate = dayjs(value).hour(newHour24).toDate();
    onChange(newDate);
  };
  
  return (
    <div className="time-picker">
      <select value={hour12} onChange={handleHourChange}>
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => (
          <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
        ))}
      </select>
      <span>:</span>
      <select value={minute} onChange={handleMinuteChange}>
        {[0, 15, 30, 45].map(min => (
          <option key={min} value={min}>{min.toString().padStart(2, '0')}</option>
        ))}
      </select>
      <select value={period} onChange={handlePeriodChange}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default App;
