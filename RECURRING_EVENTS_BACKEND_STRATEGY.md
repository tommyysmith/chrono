# Recurring Events Backend Strategy

## Overview

This document outlines the recommended **Hybrid Approach** for handling recurring events in the backend, balancing performance, storage efficiency, and user experience.

## Current Implementation

Currently, the app uses an **Expanded/Materialized** approach where every instance of a recurring event is stored as a separate row in the database:

- ✅ Simple queries
- ✅ Easy to display in calendar views
- ❌ High storage usage for long series
- ❌ Complex series-wide updates

## Recommended: Hybrid Approach

Store **master records** for recurring events and **materialize only near-term instances** (e.g., next 90 days).

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Events Table                         │
├─────────────────────────────────────────────────────────────┤
│ Master Event (is_master=true)                               │
│ - id: "evt-123"                                             │
│ - title: "Team Standup"                                     │
│ - rrule_options: { freq: "daily", interval: 1 }            │
│ - series_id: "series-456"                                   │
├─────────────────────────────────────────────────────────────┤
│ Materialized Instances (next 90 days)                       │
│ - id: "evt-123-20250107"                                    │
│ - master_event_id: "evt-123"                                │
│ - series_id: "series-456"                                   │
│ - start: 2025-01-07T09:00:00Z                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Event Exceptions Table                     │
├─────────────────────────────────────────────────────────────┤
│ Modified Instance                                            │
│ - master_event_id: "evt-123"                                │
│ - original_start: 2025-01-10T09:00:00Z                      │
│ - exception_type: "modified"                                │
│ - modified_data: { start: "2025-01-10T10:00:00Z" }          │
├─────────────────────────────────────────────────────────────┤
│ Deleted Instance                                             │
│ - master_event_id: "evt-123"                                │
│ - original_start: 2025-01-15T09:00:00Z                      │
│ - exception_type: "deleted"                                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

1. **Master Event** (`is_master = true`)
   - Contains the recurrence rules (`rrule_options`)
   - Serves as the source of truth for the series
   - Has `series_id` to link all related instances

2. **Materialized Instances** (`master_event_id != null`)
   - Pre-generated instances for performance
   - Only created for near-term occurrences (e.g., next 90 days)
   - Automatically regenerated as time passes

3. **Event Exceptions**
   - Separate table for modified or deleted single instances
   - Tracks `original_start` time for the occurrence
   - Stores full event data for modifications

### Benefits

✅ **Storage Efficient**: Don't store far-future instances  
✅ **Query Performance**: Pre-materialized instances for common queries  
✅ **Easy Updates**: Update master, regenerate affected instances  
✅ **Flexible Exceptions**: Track individual modifications efficiently  
✅ **Scalable**: Handle infinite recurring events gracefully  

## Implementation Strategy

### Phase 1: Gradual Migration (Current → Hybrid)

**Keep current behavior working while adding hybrid support:**

1. ✅ Run migration to add new columns and exception table
2. 🔄 Update data access layer to support both models
3. 🔄 Add background job to consolidate old recurring events
4. 🔄 Switch new recurring events to hybrid model

### Phase 2: Data Access Layer

Update `src/lib/supabase.js` to handle both approaches:

```javascript
// New methods for hybrid approach
async createRecurringEventSeries(userId, masterEvent, materializeMonths = 3) {
  // 1. Create master event
  const master = await this.createEvent(userId, {
    ...masterEvent,
    is_master: true
  });
  
  // 2. Generate and create instances for next N months
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + materializeMonths);
  
  const instances = generateRecurringEventsUntil(masterEvent, endDate);
  await Promise.all(
    instances.map(instance => 
      this.createEvent(userId, {
        ...instance,
        master_event_id: master.id,
        is_master: false
      })
    )
  );
  
  return master;
}

async updateRecurringEventSeries(userId, masterEventId, updates, scope = 'all') {
  if (scope === 'all') {
    // 1. Update master event
    await this.updateEvent(userId, masterEventId, updates);
    
    // 2. Delete old instances
    await this.supabase
      .from('events')
      .delete()
      .eq('master_event_id', masterEventId);
    
    // 3. Regenerate instances
    const master = await this.getEvent(userId, masterEventId);
    await this.createRecurringEventSeries(userId, master, 3);
  } else if (scope === 'single') {
    // Create an exception
    await this.createEventException(userId, {
      master_event_id: masterEventId,
      original_start: updates.originalStart,
      exception_type: 'modified',
      modified_data: updates
    });
  }
}

async getEventsInRange(userId, startDate, endDate) {
  // 1. Get materialized instances in range
  const materialized = await this.supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .gte('start', startDate.toISOString())
    .lte('start', endDate.toISOString());
  
  // 2. Get master events that might generate instances in range
  const masters = await this.supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .eq('is_master', true)
    .lte('start', endDate.toISOString()); // Master started before range end
  
  // 3. Generate missing instances from masters
  const generated = [];
  for (const master of masters) {
    const instances = generateRecurringEventsInRange(
      master,
      startDate,
      endDate
    );
    generated.push(...instances);
  }
  
  // 4. Get exceptions
  const exceptions = await this.supabase
    .from('event_exceptions')
    .select('*')
    .eq('user_id', userId)
    .gte('original_start', startDate.toISOString())
    .lte('original_start', endDate.toISOString());
  
  // 5. Merge and apply exceptions
  return mergeEventsAndExceptions(materialized, generated, exceptions);
}
```

### Phase 3: Background Jobs

Create periodic jobs to maintain the materialized instances:

```javascript
// Daily job to extend materialized instances
async function extendMaterializedInstances() {
  const allMasters = await supabase
    .from('events')
    .select('*')
    .eq('is_master', true);
  
  for (const master of allMasters) {
    const now = new Date();
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 3);
    
    // Get latest materialized instance
    const latestInstance = await supabase
      .from('events')
      .select('start')
      .eq('master_event_id', master.id)
      .order('start', { ascending: false })
      .limit(1)
      .single();
    
    if (!latestInstance || new Date(latestInstance.start) < targetDate) {
      // Generate new instances up to target date
      const newInstances = generateRecurringEventsInRange(
        master,
        latestInstance ? new Date(latestInstance.start) : now,
        targetDate
      );
      
      await Promise.all(
        newInstances.map(instance => 
          supabase.from('events').insert({
            ...instance,
            master_event_id: master.id
          })
        )
      );
    }
  }
}
```

## Decision Matrix: When to Use Each Approach

| Scenario | Recommended Approach | Reason |
|----------|---------------------|---------|
| Daily standup (infinite) | **Hybrid** | Avoid storing millions of instances |
| Weekly meeting (1 year) | **Hybrid** or Expanded | Both work well |
| Birthday reminders | **Hybrid** | Truly infinite series |
| 10-week course | **Expanded** | Fixed, short series |
| One-time event | **Regular** | No recurrence |

## Migration Path for Existing Data

```javascript
async function migrateToHybridModel(userId) {
  // 1. Group events by series_id
  const allEvents = await supabaseDataAccess.listEvents(userId);
  const seriesMap = new Map();
  
  allEvents.forEach(event => {
    if (event.seriesId && event.rruleOptions) {
      if (!seriesMap.has(event.seriesId)) {
        seriesMap.set(event.seriesId, []);
      }
      seriesMap.get(event.seriesId).push(event);
    }
  });
  
  // 2. For each series, identify the base event
  for (const [seriesId, events] of seriesMap) {
    // Find earliest event as master
    const sortedEvents = events.sort((a, b) => a.start - b.start);
    const masterEvent = sortedEvents[0];
    
    // 3. Mark it as master
    await supabase
      .from('events')
      .update({ is_master: true })
      .eq('id', masterEvent.id);
    
    // 4. Update all other instances to reference master
    await Promise.all(
      sortedEvents.slice(1).map(event => 
        supabase
          .from('events')
          .update({ 
            master_event_id: masterEvent.id,
            is_master: false 
          })
          .eq('id', event.id)
      )
    );
    
    // 5. Clean up far-future instances (optional)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() + 6);
    
    await supabase
      .from('events')
      .delete()
      .eq('series_id', seriesId)
      .gt('start', cutoffDate.toISOString());
  }
}
```

## Best Practices

### 1. Materialization Window
- **Default**: 90 days (3 months)
- **Adjust based on**: User behavior, storage limits, performance

### 2. Exception Handling
- Always check exceptions table when displaying events
- Apply exceptions before showing to user
- Keep exceptions even after instances are deleted

### 3. Series Updates
- **"This event"**: Create exception
- **"This and future"**: Update master with new `until`, create new series
- **"All events"**: Update master, regenerate instances

### 4. Deletion
- **Single instance**: Create "deleted" exception
- **Series**: Delete master (cascades to instances and exceptions)

### 5. Performance Optimization
- Index `master_event_id`, `series_id`, `original_start`
- Cache master events in memory
- Use database triggers for auto-materialization

## Monitoring & Maintenance

### Metrics to Track
- Number of master events
- Number of materialized instances
- Number of exceptions
- Average query time for date ranges
- Storage usage per user

### Maintenance Tasks
- **Daily**: Extend materialized instances
- **Weekly**: Clean up old exceptions (optional)
- **Monthly**: Analyze storage vs performance trade-offs

## Rollback Plan

If hybrid approach causes issues:

1. Keep `is_master` and `master_event_id` columns (no harm)
2. Continue creating all instances (current behavior)
3. Ignore exception table temporarily
4. Plan better migration strategy

## Conclusion

The **Hybrid Approach** provides the best balance of:
- 🎯 Performance (pre-materialized instances for common queries)
- 💾 Storage efficiency (don't store all instances)
- 🔧 Flexibility (easy to modify individual instances)
- 📈 Scalability (handles infinite recurring events)

**Recommendation**: Implement gradually, starting with new recurring events, then migrate existing data over time.


